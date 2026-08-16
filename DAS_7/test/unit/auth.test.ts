// @ts-nocheck -- jose is ESM-mocked before module import; the mock's runtime shape is intentional.
import { jest } from '@jest/globals';
import { config, parent } from './helpers.js';
import { ForbiddenError, UnauthorizedError, UnavailableError } from '../../src/errors.js';

const jwtVerify = jest.fn();
const createRemoteJWKSet = jest.fn(() => ({}));
class JOSEError extends Error {}
class JWTExpired extends JOSEError {}
class JWKSInvalid extends JOSEError {}
class JWKInvalid extends JOSEError {}
class JWKSMultipleMatchingKeys extends JOSEError {}
class JWKSTimeout extends JOSEError {}
jest.unstable_mockModule('jose', () => ({
    createRemoteJWKSet,
    jwtVerify,
    errors: {
        JOSEError,
        JWTExpired,
        JWKSTimeout,
        JWKSInvalid,
        JWKInvalid,
        JWKSMultipleMatchingKeys,
    },
}));
const { createAuthenticate } = await import('../../src/http/auth.js');

describe('Auth.createAuthenticate()', () => {
    beforeEach(() => {
        jwtVerify.mockReset();
        jwtVerify.mockResolvedValue({ payload: { sub: 'auth1' } });
        createRemoteJWKSet.mockClear();
    });
    function invoke(header?: string, found = parent, authConfig = config) {
        const repo = { byAuthUserId: jest.fn().mockResolvedValue(found) };
        const req: any = { headers: { authorization: header } };
        const next = jest.fn();
        const middleware = createAuthenticate({
            parentRepo: repo as any,
            config: authConfig,
        });
        return { req, next, repo, run: () => middleware(req, {} as any, next) };
    }
    it('UT-DAS7-U28-01 rejects an absent authorization header', async () => {
        const x = invoke();
        await expect(x.run()).rejects.toBeInstanceOf(UnauthorizedError);
        expect(jwtVerify).not.toHaveBeenCalled();
    });
    it('UT-DAS7-U28-02 rejects a malformed authorization header', async () => {
        const x = invoke('Basic token');
        await expect(x.run()).rejects.toBeInstanceOf(UnauthorizedError);
        expect(jwtVerify).not.toHaveBeenCalled();
    });
    it('UT-DAS7-U28-03 accepts canonical Bearer grammar', async () => {
        const x = invoke('Bearer token');
        await expect(x.run()).resolves.toBeUndefined();
        expect(x.req.parent).toEqual(parent);
        expect(x.next).toHaveBeenCalledTimes(1);
    });
    it('UT-DAS7-U28-04 accepts case-insensitive Bearer with repeated spaces', async () => {
        const x = invoke('bearer   token');
        await expect(x.run()).resolves.toBeUndefined();
        expect(jwtVerify).toHaveBeenCalledWith('token', expect.anything(), expect.anything());
    });
    it('UT-DAS7-U28-05 maps a token failure to unauthorized', async () => {
        const x = invoke('Bearer token');
        jwtVerify.mockRejectedValue(new JWTExpired());
        await expect(x.run()).rejects.toBeInstanceOf(UnauthorizedError);
    });
    it('UT-DAS7-U28-06 maps a JWKS timeout to unavailable', async () => {
        const x = invoke('Bearer token');
        jwtVerify.mockRejectedValue(new JWKSTimeout());
        await expect(x.run()).rejects.toBeInstanceOf(UnavailableError);
    });
    it('UT-DAS7-U28-07 maps a generic JOSE infrastructure failure to unavailable', async () => {
        const x = invoke('Bearer token');
        jwtVerify.mockRejectedValue(Object.assign(new JOSEError(), { code: 'ERR_JOSE_GENERIC' }));
        await expect(x.run()).rejects.toBeInstanceOf(UnavailableError);
    });
    it('UT-DAS7-U28-08 maps a non-JOSE verifier failure to unavailable', async () => {
        const x = invoke('Bearer token');
        jwtVerify.mockRejectedValue(new Error('network'));
        await expect(x.run()).rejects.toBeInstanceOf(UnavailableError);
    });
    it('UT-DAS7-U28-09 rejects a payload without a subject', async () => {
        jwtVerify.mockResolvedValue({ payload: {} });
        const x = invoke('Bearer token');
        await expect(x.run()).rejects.toBeInstanceOf(UnauthorizedError);
    });
    it('UT-DAS7-U28-10 rejects an unregistered parent', async () => {
        const x = invoke('Bearer token', null);
        await expect(x.run()).rejects.toBeInstanceOf(ForbiddenError);
    });
    it('UT-DAS7-U28-11 propagates a parent lookup failure', async () => {
        const x = invoke('Bearer token');
        x.repo.byAuthUserId.mockRejectedValue(new Error('db'));
        await expect(x.run()).rejects.toThrow('db');
    });
    it('UT-DAS7-U28-12 configures the JWKS URL and normalized issuer', async () => {
        const authConfig = { ...config, supabaseUrl: 'https://project.supabase.co///' };
        const x = invoke('Bearer token', parent, authConfig);
        await expect(x.run()).resolves.toBeUndefined();
        expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL(authConfig.supabaseJwksUrl));
        expect(jwtVerify).toHaveBeenCalledWith('token', expect.anything(), {
            issuer: 'https://project.supabase.co/auth/v1',
        });
    });
});
