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

  it('routes owner computer commands (2026-07-10 regression: "limited capability" refusals)', () => {
    expect(gate('Open my Mission-Control project folder')).toBe(true);
    expect(gate('Launch the dashboard project')).toBe(true);
    expect(gate('Organize my downloads folder')).toBe(true);
    expect(gate('Run the test suite for the payment module')).toBe(true);
  });

  it('routes explicit Claw directives in natural owner phrasing', () => {
    expect(gate('Use Claw to organize my downloads folder')).toBe(true);
    expect(gate('Have Claw fix the login bug')).toBe(true);
    expect(gate('I want Claw to build a landing page for the studio')).toBe(true);
    expect(gate('Tell Claw to create a test file in the sandbox')).toBe(true);
    expect(gate('Claw should clean up the logs directory')).toBe(true);
    expect(gate('Ask OpenClaw to update the README')).toBe(true);
  });

  it('does NOT route Claw capability questions or status chat', () => {
    expect(gate('can you tell claw what to do if I tell you what I want done?')).toBe(false);
    expect(gate('What is Claw working on right now?')).toBe(false);
    expect(gate('do you have access to do what I want you to do on this computer')).toBe(false);
  });
});
