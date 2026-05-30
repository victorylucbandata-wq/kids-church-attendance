// ============================================================
// Kids Church Attendance — Google Apps Script
// ============================================================
// SETUP:
//   1. Create a Google Sheet with tabs: Members, Sessions, Attendance, FirstTimers
//   2. In Apps Script: File > Project Properties > Script Properties
//      Add: ATTENDANCE_SECRET = <your secret>
//           SPREADSHEET_ID    = <your spreadsheet ID from the URL>
//   3. Set timezone to Asia/Manila in Project Settings
//   4. Deploy > New Deployment > Web app
//      Execute as: Me | Access: Anyone
//   5. Copy the /exec URL into .env.local as GOOGLE_SCRIPT_URL
// ============================================================

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getManilaDate() {
  return Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
}

// Sheets stores dates as Date objects when you type/paste them.
// This normalises a cell value to a YYYY-MM-DD string regardless.
function toDateStr(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Manila', 'yyyy-MM-dd');
  }
  return String(value);
}

function getManilaTimestamp() {
  return Utilities.formatDate(new Date(), 'Asia/Manila', "yyyy-MM-dd'T'HH:mm:ss");
}

// ============================================================
// ENTRY POINT
// ============================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('ATTENDANCE_SECRET');

    if (body.secret !== secret) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    var action = body.action;

    if (action === 'getSession')          return getSession(body);
    if (action === 'generateSession')     return generateSession(body);
    if (action === 'getUncheckedMembers') return getUncheckedMembers(body);
    if (action === 'checkIn')             return checkIn(body);
    if (action === 'submitFirstTimer')    return submitFirstTimer(body);
    if (action === 'getAdminData')        return getAdminData(body);

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// getSession
// Returns today's session row or null.
// ============================================================

function getSession(body) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Sessions');
  var today = getManilaDate();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (toDateStr(data[i][1]) === today) {
      return jsonResponse({
        success: true,
        session: {
          sessionId:   data[i][0],
          sessionDate: toDateStr(data[i][1]),
          schedule:    data[i][2],
          generatedAt: String(data[i][3])
        }
      });
    }
  }

  return jsonResponse({ success: true, session: null });
}

// ============================================================
// generateSession
// Creates a Sessions row + one Attendance row per active member.
// Returns error if a session already exists for today.
// Request: { schedule }
// ============================================================

function generateSession(body) {
  var ss = getSpreadsheet();
  var today = getManilaDate();
  var sessionsSheet  = ss.getSheetByName('Sessions');
  var attendanceSheet = ss.getSheetByName('Attendance');
  var membersSheet   = ss.getSheetByName('Members');

  // Guard: session already exists today?
  var sessData = sessionsSheet.getDataRange().getValues();
  for (var i = 1; i < sessData.length; i++) {
    if (toDateStr(sessData[i][1]) === today) {
      return jsonResponse({ success: false, error: 'Session already exists for today.' });
    }
  }

  var schedule  = body.schedule || 'Sunday Morning';
  var suffix    = schedule === 'Sunday Morning' ? 'AM' : schedule === 'Sunday Afternoon' ? 'PM' : 'SE';
  var sessionId = 'S' + today + '-' + suffix;
  var generatedAt = getManilaTimestamp();

  sessionsSheet.appendRow([sessionId, today, schedule, generatedAt, 'admin']);

  // Get active members and sort by name
  var membersData = membersSheet.getDataRange().getValues();
  var activeMembers = [];
  for (var j = 1; j < membersData.length; j++) {
    var isActive = membersData[j][6];
    if (isActive === true || isActive === 'TRUE') {
      activeMembers.push({
        memberId: membersData[j][0],
        fullName: membersData[j][1],
        ageGroup: membersData[j][2]
      });
    }
  }
  activeMembers.sort(function(a, b) { return a.fullName.localeCompare(b.fullName); });

  // Build all attendance rows in memory, then write them in a single setValues call.
  // appendRow per member is one network round-trip each — slow for large rosters.
  if (activeMembers.length > 0) {
    var rows = activeMembers.map(function(m) {
      return [
        'A' + today + '-' + m.memberId,  // AttendanceID
        sessionId,                        // SessionID
        today,                            // SessionDate
        m.memberId,                       // MemberID
        m.fullName,                       // MemberName
        m.ageGroup,                       // AgeGroup
        false,                            // CheckedIn
        '',                               // CheckedInAt
        ''                                // Notes
      ];
    });
    var startRow = attendanceSheet.getLastRow() + 1;
    attendanceSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  return jsonResponse({ success: true, sessionId: sessionId, memberCount: activeMembers.length });
}

// ============================================================
// getUncheckedMembers
// Returns Attendance rows for today not yet checked in, sorted A-Z.
// ============================================================

function getUncheckedMembers(body) {
  var ss = getSpreadsheet();
  var today = getManilaDate();

  var sessSheet = ss.getSheetByName('Sessions');
  var sessData  = sessSheet.getDataRange().getValues();
  var sessionId = null;
  for (var i = 1; i < sessData.length; i++) {
    if (toDateStr(sessData[i][1]) === today) {
      sessionId = sessData[i][0];
      break;
    }
  }

  if (!sessionId) {
    return jsonResponse({ success: true, sessionId: null, members: [] });
  }

  var attSheet = ss.getSheetByName('Attendance');
  var attData  = attSheet.getDataRange().getValues();
  var unchecked = [];

  for (var j = 1; j < attData.length; j++) {
    var row = attData[j];
    var checkedIn = row[6];
    if (row[1] === sessionId && (checkedIn === false || checkedIn === 'FALSE' || checkedIn === '')) {
      unchecked.push({
        attendanceId: row[0],
        memberId:     row[3],
        memberName:   row[4],
        ageGroup:     row[5]
      });
    }
  }

  unchecked.sort(function(a, b) { return a.memberName.localeCompare(b.memberName); });

  return jsonResponse({ success: true, sessionId: sessionId, members: unchecked });
}

// ============================================================
// checkIn
// Marks an Attendance row as checked in.
// Request: { attendanceId, notes? }
// ============================================================

function checkIn(body) {
  var ss = getSpreadsheet();
  var attSheet = ss.getSheetByName('Attendance');

  // Read only column A (AttendanceID) to find the row, not the whole sheet.
  var lastRow = attSheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ success: false, error: 'Attendance record not found: ' + body.attendanceId });
  }
  var ids = attSheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === body.attendanceId) {
      var rowNum = i + 2;
      // Write CheckedIn, CheckedInAt, Notes (cols 7-9) in a single call.
      attSheet.getRange(rowNum, 7, 1, 3).setValues([[true, getManilaTimestamp(), body.notes || '']]);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, error: 'Attendance record not found: ' + body.attendanceId });
}

// ============================================================
// submitFirstTimer
// 1. Saves to FirstTimers tab
// 2. Adds child to Members tab
// 3. If today's session exists, adds to Attendance as checked in
// Request: { parentName, contactNumber, childName, age?, ageGroup, notes? }
// ============================================================

function getNextMemberId(membersSheet) {
  var data = membersSheet.getDataRange().getValues();
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    if (/^M\d+$/.test(id)) {
      var num = parseInt(id.substring(1), 10);
      if (num > maxNum) maxNum = num;
    }
  }
  var next = String(maxNum + 1);
  while (next.length < 3) next = '0' + next;
  return 'M' + next;
}

function submitFirstTimer(body) {
  var ss           = getSpreadsheet();
  var ftSheet      = ss.getSheetByName('FirstTimers');
  var membersSheet = ss.getSheetByName('Members');
  var today        = getManilaDate();
  var timestamp    = getManilaTimestamp();
  var now          = new Date();

  // 1. Save to FirstTimers
  ftSheet.appendRow([
    'FT-' + now.getTime(),
    timestamp,
    today,
    body.parentName    || '',
    body.contactNumber || '',
    body.childName     || '',
    body.age           || '',
    body.ageGroup      || '',
    body.notes         || ''
  ]);

  // 2. Add to Members
  var memberId = getNextMemberId(membersSheet);
  membersSheet.appendRow([
    memberId,
    body.childName     || '',
    body.ageGroup      || '',
    body.parentName    || '',
    body.contactNumber || '',
    body.notes         || '',
    true,
    today
  ]);

  // 3. If today's session exists, add to Attendance as already checked in
  var sessSheet = ss.getSheetByName('Sessions');
  var sessData  = sessSheet.getDataRange().getValues();
  var sessionId = null;
  for (var i = 1; i < sessData.length; i++) {
    if (toDateStr(sessData[i][1]) === today) {
      sessionId = sessData[i][0];
      break;
    }
  }

  if (sessionId) {
    var attSheet = ss.getSheetByName('Attendance');
    attSheet.appendRow([
      'A' + today + '-' + memberId,
      sessionId,
      today,
      memberId,
      body.childName || '',
      body.ageGroup  || '',
      true,
      timestamp,
      body.notes || ''
    ]);
  }

  return jsonResponse({ success: true, memberId: memberId });
}

// ============================================================
// getAdminData
// Returns full dashboard data for today.
// ============================================================

function getAdminData(body) {
  var ss    = getSpreadsheet();
  var today = getManilaDate();

  // Get today's session
  var sessSheet = ss.getSheetByName('Sessions');
  var sessData  = sessSheet.getDataRange().getValues();
  var session   = null;
  for (var i = 1; i < sessData.length; i++) {
    if (toDateStr(sessData[i][1]) === today) {
      session = {
        sessionId:   sessData[i][0],
        sessionDate: toDateStr(sessData[i][1]),
        schedule:    sessData[i][2],
        generatedAt: String(sessData[i][3])
      };
      break;
    }
  }

  var attendanceRows = [];
  var checkedInCount = 0;

  if (session) {
    var attSheet = ss.getSheetByName('Attendance');
    var attData  = attSheet.getDataRange().getValues();

    for (var j = 1; j < attData.length; j++) {
      var row = attData[j];
      if (row[1] === session.sessionId) {
        var checkedIn = row[6] === true || row[6] === 'TRUE';
        attendanceRows.push({
          attendanceId: row[0],
          memberName:   row[4],
          ageGroup:     row[5],
          checkedIn:    checkedIn,
          checkedInAt:  row[7] || null,
          notes:        row[8] || ''
        });
        if (checkedIn) checkedInCount++;
      }
    }

    attendanceRows.sort(function(a, b) { return a.memberName.localeCompare(b.memberName); });
  }

  // First-timers today
  var ftSheet = ss.getSheetByName('FirstTimers');
  var ftData  = ftSheet.getDataRange().getValues();
  var firstTimers = [];
  for (var k = 1; k < ftData.length; k++) {
    if (toDateStr(ftData[k][2]) === today) {
      firstTimers.push({
        submittedAt:   ftData[k][1],
        parentName:    ftData[k][3],
        contactNumber: ftData[k][4],
        childName:     ftData[k][5],
        age:           ftData[k][6],
        ageGroup:      ftData[k][7],
        notes:         ftData[k][8]
      });
    }
  }

  return jsonResponse({
    success: true,
    session: session,
    attendanceRows: attendanceRows,
    firstTimers: firstTimers,
    summary: {
      totalMembers:    attendanceRows.length,
      checkedIn:       checkedInCount,
      notCheckedIn:    attendanceRows.length - checkedInCount,
      firstTimersToday: firstTimers.length
    }
  });
}
