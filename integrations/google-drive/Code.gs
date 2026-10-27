/**
 * OMNI — general document intake for a single owner-controlled Drive folder.
 *
 * Required Script Properties (Project Settings > Script properties):
 *   OMNI_RECEIVER_SECRET: a random secret, also stored server-side on Vercel.
 *   OMNI_FOLDER_ID:       the only permitted destination folder ID.
 *
 * Do not put either a secret or user file data in logs or in the source code.
 * The web app must execute as its owner. doGet never reads Drive.
 */
var MAX_FILE_BYTES_ = 3 * 1024 * 1024;
var ALLOWED_MIMES_ = {
  'text/plain': true,
  'text/markdown': true,
  'text/csv': true,
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
  'image/png': true,
  'image/jpeg': true
};

function doGet() {
  return json_({ service: 'omni-drive-receiver', version: 1, method: 'POST' });
}

function doPost(event) {
  var lock;
  try {
    var properties = PropertiesService.getScriptProperties();
    var expectedSecret = properties.getProperty('OMNI_RECEIVER_SECRET');
    var allowedFolder = properties.getProperty('OMNI_FOLDER_ID');
    if (!expectedSecret || expectedSecret.length < 32 || !allowedFolder) {
      return json_({ error: 'receiver_unconfigured' });
    }

    var raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || raw.length > Math.ceil(MAX_FILE_BYTES_ / 3) * 4 + 16384) {
      return json_({ error: 'invalid_request' });
    }

    var request;
    try {
      request = JSON.parse(raw);
    } catch (_) {
      return json_({ error: 'invalid_json' });
    }
    if (!request || !equalSecret_(request.secret, expectedSecret)) {
      return json_({ error: 'unauthorized' });
    }
    if (request.folder !== allowedFolder) {
      return json_({ error: 'folder_not_allowed' });
    }
    if (typeof request.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(request.id)) {
      return json_({ error: 'invalid_upload_id' });
    }
    if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 500) {
      return json_({ error: 'invalid_name' });
    }
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIMES_, request.mime)) {
      return json_({ error: 'file_type' });
    }
    if (typeof request.data !== 'string' || !request.data || request.data.length > Math.ceil(MAX_FILE_BYTES_ / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data)) {
      return json_({ error: 'file_size' });
    }

    var bytes;
    try {
      bytes = Utilities.base64Decode(request.data);
    } catch (_) {
      return json_({ error: 'invalid_base64' });
    }
    if (bytes.length < 1 || bytes.length > MAX_FILE_BYTES_) {
      return json_({ error: 'file_size' });
    }

    var digest = digest_(bytes);
    var prefix = 'omni-upload-' + request.id;
    var name = Array.from(request.name.normalize('NFC').replace(/[\x00-\x1f/\\]/g, '_')).slice(0, 220).join('');
    var destinationName = prefix + ' - ' + name;

    // One lock serializes duplicate requests even when different serverless
    // instances retry an upload concurrently. The UUID prefix is also a durable
    // index in Drive, so deduplication does not depend on a bounded properties DB.
    lock = LockService.getScriptLock();
    if (!lock.tryLock(12000)) {
      return json_({ error: 'receiver_busy' });
    }

    var folder = DriveApp.getFolderById(allowedFolder);
    var existing = folder.searchFiles("title contains '" + prefix + "' and trashed = false");
    while (existing.hasNext()) {
      var file = existing.next();
      if (file.getName().indexOf(prefix + ' - ') !== 0) continue;
      // Read the saved bytes on retry: this also recovers a file if execution
      // stopped after createFile but before its description was written.
      if (digest_(file.getBlob().getBytes()) !== digest) {
        return json_({ error: 'upload_id_conflict' });
      }
      return json_({ id: file.getId(), webViewLink: file.getUrl(), duplicate: true });
    }

    var created = folder.createFile(Utilities.newBlob(bytes, request.mime, destinationName));
    created.setDescription(JSON.stringify({ source: 'omni-document-channel', uploadId: request.id, sha256: digest }));
    // Inherit the destination folder's existing permissions. No public sharing,
    // no ACL edits, no file overwrite and no delete operation are performed.
    return json_({ id: created.getId(), webViewLink: created.getUrl(), duplicate: false });
  } catch (_) {
    // Do not return exception text: it can contain account or document details.
    return json_({ error: 'receiver_error' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function equalSecret_(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  var mismatch = given.length ^ expected.length;
  var length = Math.max(given.length, expected.length);
  for (var i = 0; i < length; i++) {
    mismatch |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

function digest_(bytes) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)).replace(/=+$/, '');
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
