import { describe, it, expect } from 'vitest';
import { mapDeepgramMessage, sanitizeLanguage } from './DeepgramRelay.js';
import { ElevenLabsTtsService, isValidVoiceId } from './ElevenLabsTts.js';

describe('mapDeepgramMessage', () => {
  it('maps a Results message to the client transcript protocol', () => {
    const raw = JSON.stringify({
      type: 'Results',
      is_final: true,
      speech_final: true,
      channel: { alternatives: [{ transcript: 'hello kiaros', confidence: 0.98 }] },
    });

    expect(mapDeepgramMessage(raw)).toEqual({
      type: 'transcript',
      transcript: 'hello kiaros',
      confidence: 0.98,
      isFinal: true,
      speechFinal: true,
    });
  });

  it('maps interim results with isFinal false', () => {
    const raw = JSON.stringify({
      type: 'Results',
      is_final: false,
      speech_final: false,
      channel: { alternatives: [{ transcript: 'hel', confidence: 0.4 }] },
    });

    const mapped = mapDeepgramMessage(raw);
    expect(mapped?.isFinal).toBe(false);
    expect(mapped?.speechFinal).toBe(false);
  });

  it('ignores Metadata and malformed messages', () => {
    expect(mapDeepgramMessage(JSON.stringify({ type: 'Metadata' }))).toBeNull();
    expect(mapDeepgramMessage('not json')).toBeNull();
    expect(mapDeepgramMessage(JSON.stringify({ type: 'Results' }))).toBeNull();
  });
});

describe('sanitizeLanguage', () => {
  it('accepts valid language tags', () => {
    expect(sanitizeLanguage('en-US')).toBe('en-US');
    expect(sanitizeLanguage('es')).toBe('es');
    expect(sanitizeLanguage('pt-BR')).toBe('pt-BR');
  });

  it('rejects injection-shaped or invalid values', () => {
    expect(sanitizeLanguage('en-US&model=evil')).toBe('');
    expect(sanitizeLanguage('../../etc')).toBe('');
    expect(sanitizeLanguage(null)).toBe('');
    expect(sanitizeLanguage('')).toBe('');
  });
});

describe('isValidVoiceId', () => {
  it('accepts the configured Kiaros voice id', () => {
    expect(isValidVoiceId('bIHbv24MWmeRgasZH58o')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(isValidVoiceId('')).toBe(false);
    expect(isValidVoiceId('short')).toBe(false);
    expect(isValidVoiceId('has spaces here!')).toBe(false);
    expect(isValidVoiceId('../path/injection')).toBe(false);
  });
});

describe('ElevenLabsTtsService', () => {
  it('reports unconfigured without a key and refuses to synthesize', async () => {
    const service = new ElevenLabsTtsService({ apiKey: '', voiceId: 'bIHbv24MWmeRgasZH58o', modelId: 'eleven_multilingual_v2' });
    expect(service.isConfigured()).toBe(false);

    const result = await service.synthesize('hello');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TTS_NOT_CONFIGURED');
      expect(result.status).toBe(503);
    }
  });

  it('rejects an invalid voice id override before any network call', async () => {
    const service = new ElevenLabsTtsService({ apiKey: 'test-key', voiceId: 'bIHbv24MWmeRgasZH58o', modelId: 'eleven_multilingual_v2' });
    const result = await service.synthesize('hello', 'bad voice id!');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_VOICE_ID');
    }
  });

  it('exposes the configured voice id', () => {
    const service = new ElevenLabsTtsService({ apiKey: 'k', voiceId: 'bIHbv24MWmeRgasZH58o', modelId: 'm' });
    expect(service.getVoiceId()).toBe('bIHbv24MWmeRgasZH58o');
  });
});
