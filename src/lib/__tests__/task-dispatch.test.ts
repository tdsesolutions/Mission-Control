import { describe, expect, it } from 'vitest'
import { resolveTaskDispatchModelOverride, findAssistantTextAfterTaskPrompt } from '@/lib/task-dispatch'

describe('resolveTaskDispatchModelOverride', () => {
  it('returns null when the agent has no explicit dispatch model override', () => {
    expect(resolveTaskDispatchModelOverride({ agent_config: null })).toBeNull()
    expect(resolveTaskDispatchModelOverride({ agent_config: '{"openclawId":"main"}' })).toBeNull()
  })

  it('returns the explicit dispatch model override when present', () => {
    expect(
      resolveTaskDispatchModelOverride({
        agent_config: '{"openclawId":"main","dispatchModel":"openai-codex/gpt-5.4"}',
      })
    ).toBe('openai-codex/gpt-5.4')
  })

  it('ignores malformed agent config payloads', () => {
    expect(resolveTaskDispatchModelOverride({ agent_config: '{not json' })).toBeNull()
  })
})

describe('findAssistantTextAfterTaskPrompt', () => {
  const task = {
    id: 4,
    title: 'Audit project',
    assigned_to: 'main',
    metadata: null,
    workspace_id: 1,
    ticket_prefix: null,
    project_ticket_no: null,
  }

  const line = (role: string, content: string) =>
    JSON.stringify({ type: 'message', message: { role, content } })

  it('returns the final report, not the opening narration (task 4 regression)', () => {
    const transcript = [
      line('user', 'TASK-4: audit the project'),
      line('assistant', 'Let me search for the specific project "Defining Your Testing RTC":'),
      line('assistant', 'The project is essentially empty - all files are 0 bytes.'),
      line('assistant', '## AUDIT REPORT\n\nFull findings: the project is scaffolding only, with 0-byte files throughout and no git history. Recommended next steps follow below in detail.'),
    ].join('\n')

    const text = findAssistantTextAfterTaskPrompt(transcript, task)
    expect(text).toContain('AUDIT REPORT')
    expect(text).not.toContain('Let me search')
  })

  it('falls back to the longest text when the last message is a short sign-off', () => {
    const report = '## REPORT\n' + 'finding line\n'.repeat(60)
    const transcript = [
      line('user', 'TASK-4: audit the project'),
      line('assistant', report),
      line('assistant', 'Done.'),
    ].join('\n')

    expect(findAssistantTextAfterTaskPrompt(transcript, task)).toContain('## REPORT')
  })

  it('keeps a meaningful final message even when an earlier one is longer', () => {
    const transcript = [
      line('user', 'TASK-4: audit the project'),
      line('assistant', 'Intermediate exploration output. '.repeat(40)),
      line('assistant', 'Final summary: audit complete, three issues found, details in Mission Control comments.'),
    ].join('\n')

    expect(findAssistantTextAfterTaskPrompt(transcript, task)).toContain('Final summary')
  })

  it('returns null when the task marker never appears', () => {
    const transcript = [
      line('user', 'unrelated conversation'),
      line('assistant', 'unrelated reply'),
    ].join('\n')

    expect(findAssistantTextAfterTaskPrompt(transcript, task)).toBeNull()
  })
})
