/**
 * Dispatch-gate tests: which conversational messages reach the Approval
 * Engine. Regression source: "Refactor the payment module to use the new
 * API client" was detected as a non-command intent, skipped dispatch, and
 * the LLM then hallucinated a created task (2026-07-09).
 */

import { describe, it, expect } from 'vitest';
import { isActionRequest } from './ConversationManager.js';
import { IntentDetector } from './IntentDetector.js';

const detector = new IntentDetector();
const gate = (content: string) => isActionRequest(content, detector.detect(content));

describe('isActionRequest (conversation dispatch gate)', () => {
  it('routes explicit command-intent messages', () => {
    expect(gate('Create a task to update the website')).toBe(true);
    expect(gate('dispatch an agent to clean the logs')).toBe(true);
  });

  it('routes imperative work requests the intent taxonomy files elsewhere', () => {
    expect(gate('Refactor the payment module to use the new API client')).toBe(true);
    expect(gate('Fix the login bug in the dashboard project')).toBe(true);
    expect(gate('please update the onboarding copy')).toBe(true);
    expect(gate('Implement rate limiting on the events endpoint')).toBe(true);
    expect(gate('Deploy the landing page')).toBe(true);
  });

  it('does NOT route questions or discussion', () => {
    expect(gate('How do I fix the login bug?')).toBe(false);
    expect(gate('What is the status of the system?')).toBe(false);
    expect(gate('Why is the build failing?')).toBe(false);
    expect(gate('Good morning, how are you?')).toBe(false);
    expect(gate('Can you explain how the approval engine works?')).toBe(false);
  });

  it('does NOT route mid-sentence verb mentions', () => {
    expect(gate('I wonder whether we should fix that someday')).toBe(false);
    expect(gate('The team will update the docs next week')).toBe(false);
  });
});
