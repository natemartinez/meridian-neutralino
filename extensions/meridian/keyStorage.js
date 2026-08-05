// extensions/meridian/keyStorage.js
// API-key storage mode for the Meridian Neutralino extension.
//
// Meridian stores its OpenRouter API key in Neutralino storage. When the
// extension is launched with --enable-encrypted-storage, we request the OS
// keychain (via Neutralino.storage.setNativeStorageEnabled(true)) so the key
// lives in the operating system's secure credential store instead of a
// plaintext storage.json file.
//
// The renderer reads the mode via the 'getKeyStorageMode' extension method
// and labels the UI honestly: "stored encrypted in your OS keychain" when
// the flag is set, "stored locally on this device" otherwise. Meridian never
// claims encryption that isn't requested/active.

let nativeStorageEnabled = process.argv.includes('--enable-encrypted-storage');

function setEncryptedMode(enabled) {
  nativeStorageEnabled = !!enabled;
}

function isEncryptedMode() {
  return nativeStorageEnabled;
}

module.exports = {
  setEncryptedMode,
  isEncryptedMode,
};
