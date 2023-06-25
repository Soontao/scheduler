import assert from 'node:assert';
import { describe, it } from 'node:test';
import { a } from "../src/index.js";

describe('Test Suite', () => {

  it('should equal to 1', () => {
    assert.strictEqual(a, 1)
  });

});