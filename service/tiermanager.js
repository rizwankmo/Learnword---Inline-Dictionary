// tiermanager.js - Centralized tier management
// This module handles all tier-related logic including limits, license validation, and progress tracking

// Public key for license validation (replace with actual public key)
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyour_public_key_here
-----END PUBLIC KEY-----`;

const TierManager = {
  /**
   * Import public key for verification
   */
  async getPublicKey() {
    if (this._publicKey) return this._publicKey;

    try {
      const pemHeader = '-----BEGIN PUBLIC KEY-----';
      const pemFooter = '-----END PUBLIC KEY-----';
      const pemContents = PUBLIC_KEY_PEM.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
      const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

      this._publicKey = await crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['verify']
      );
      return this._publicKey;
    } catch (err) {
      console.error('Failed to import public key:', err);
      throw err;
    }
  },

  /**
   * Verify license key signature
   */
  async verifyLicenseKey(licenseKey) {
    try {
      // Assume license key format: payload.signature (base64url)
      const parts = licenseKey.split('.');
      if (parts.length !== 2) return false;

      const [payloadB64, signatureB64] = parts;

      // Decode payload and signature
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

      const publicKey = await this.getPublicKey();

      // Verify signature
      const encoder = new TextEncoder();
      const data = encoder.encode(payloadB64);
      const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data);

      if (!isValid) return false;

      // Check if license is still valid (not expired)
      const now = Date.now() / 1000;
      if (payload.exp && payload.exp < now) return false;

      return true;
    } catch (err) {
      console.error('License verification failed:', err);
      return false;
    }
  },

  /**
   * Get user's current tier
   */
  async getUserTier() {
    try {
      const data = await chrome.storage.sync.get(['tier', 'licenseKey']);
      return data.tier || 'free';
    } catch (err) {
      console.error('Failed to get tier:', err);
      return 'free';
    }
  },

  /**
   * Activate pro license
   */
  async activateLicense(licenseKey) {
    try {
      // Verify license key signature
      const isValid = await this.verifyLicenseKey(licenseKey);
      if (!isValid) {
        throw new Error('Invalid or expired license key');
      }

      await chrome.storage.sync.set({
        tier: 'pro',
        licenseKey: licenseKey,
        licensedAt: Date.now()
      });

      return { success: true };
    } catch (err) {
      console.error('License activation failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Deactivate pro license
   */
  async deactivateLicense() {
    try {
      await chrome.storage.sync.set({
        tier: 'free',
        licenseKey: '',
        licensedAt: 0,
        lookupCount: 0,
        lastResetDate: new Date().toDateString()
      });

      return { success: true };
    } catch (err) {
      console.error('License deactivation failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get lookup progress for current session
   */
  async getLookupProgress() {
    try {
      const data = await chrome.storage.local.get(['lookupCount', 'lastResetDate']);
      const lookupCount = data.lookupCount || 0;
      const resetDate = data.lastResetDate || new Date().toDateString();
      return { lookupCount, resetDate };
    } catch (err) {
      console.error('Failed to get lookup progress:', err);
      return { lookupCount: 0, resetDate: new Date().toDateString() };
    }
  },
};