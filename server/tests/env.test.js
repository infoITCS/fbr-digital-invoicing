const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeFbrConfig } = require('../src/config/env');

const original = {
  FBR_ENVIRONMENT: process.env.FBR_ENVIRONMENT,
  FBR_VALIDATE_URL: process.env.FBR_VALIDATE_URL,
  FBR_SUBMIT_URL: process.env.FBR_SUBMIT_URL,
};

const SANDBOX_VALIDATE =
  'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb';
const SANDBOX_SUBMIT =
  'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';
const PRODUCTION_VALIDATE =
  'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata';
const PRODUCTION_SUBMIT =
  'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata';

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FBR_ENVIRONMENT', original.FBR_ENVIRONMENT);
  restoreEnv('FBR_VALIDATE_URL', original.FBR_VALIDATE_URL);
  restoreEnv('FBR_SUBMIT_URL', original.FBR_SUBMIT_URL);
});

describe('assertSafeFbrConfig', () => {
  it('allows sandbox with sandbox URLs', () => {
    process.env.FBR_ENVIRONMENT = 'sandbox';
    process.env.FBR_VALIDATE_URL = SANDBOX_VALIDATE;
    process.env.FBR_SUBMIT_URL = SANDBOX_SUBMIT;
    assert.doesNotThrow(() => assertSafeFbrConfig());
  });

  it('allows production with live FBR URLs', () => {
    process.env.FBR_ENVIRONMENT = 'production';
    process.env.FBR_VALIDATE_URL = PRODUCTION_VALIDATE;
    process.env.FBR_SUBMIT_URL = PRODUCTION_SUBMIT;
    assert.doesNotThrow(() => assertSafeFbrConfig());
  });

  it('rejects unknown environments', () => {
    process.env.FBR_ENVIRONMENT = 'staging';
    process.env.FBR_VALIDATE_URL = SANDBOX_VALIDATE;
    process.env.FBR_SUBMIT_URL = SANDBOX_SUBMIT;
    assert.throws(
      () => assertSafeFbrConfig(),
      /Use "sandbox" or "production"/
    );
  });

  it('rejects production environment with sandbox URLs', () => {
    process.env.FBR_ENVIRONMENT = 'production';
    process.env.FBR_VALIDATE_URL = SANDBOX_VALIDATE;
    process.env.FBR_SUBMIT_URL = SANDBOX_SUBMIT;
    assert.throws(
      () => assertSafeFbrConfig(),
      /requires live FBR endpoints/
    );
  });

  it('rejects sandbox environment with production URLs', () => {
    process.env.FBR_ENVIRONMENT = 'sandbox';
    process.env.FBR_VALIDATE_URL = PRODUCTION_VALIDATE;
    process.env.FBR_SUBMIT_URL = PRODUCTION_SUBMIT;
    assert.throws(
      () => assertSafeFbrConfig(),
      /requires sandbox FBR endpoints/
    );
  });
});
