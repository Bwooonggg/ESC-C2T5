import { describe, expect, it, jest } from '@jest/globals'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { withMySqlTransaction } from '../../../src/infrastructure/mysql/transaction-manager.js'

describe('MySQL transaction manager', () => {
    it('commits the callback result and releases the connection', async () => {
        const connection = createFakeConnection()
        const pool = createFakePool(connection)
        const work = jest.fn(async (transaction: PoolConnection) => {
            expect(transaction).toBe(connection)
            return 'committed'
        })

        await expect(withMySqlTransaction(pool, work)).resolves.toBe(
            'committed',
        )

        expect(pool.getConnection).toHaveBeenCalledTimes(1)
        expect(connection.beginTransaction).toHaveBeenCalledTimes(1)
        expect(connection.commit).toHaveBeenCalledTimes(1)
        expect(connection.rollback).not.toHaveBeenCalled()
        expect(connection.release).toHaveBeenCalledTimes(1)
        expect(connection.beginTransaction.mock.invocationCallOrder[0]).toBeLessThan(
            connection.commit.mock.invocationCallOrder[0]!,
        )
        expect(connection.commit.mock.invocationCallOrder[0]).toBeLessThan(
            connection.release.mock.invocationCallOrder[0]!,
        )
    })

    it('rolls back callback failures, preserves the error, and releases', async () => {
        const connection = createFakeConnection()
        const pool = createFakePool(connection)
        const failure = new Error('write failed')
        const work = jest.fn(async () => {
            throw failure
        })

        await expect(withMySqlTransaction(pool, work)).rejects.toBe(failure)

        expect(connection.beginTransaction).toHaveBeenCalledTimes(1)
        expect(connection.commit).not.toHaveBeenCalled()
        expect(connection.rollback).toHaveBeenCalledTimes(1)
        expect(connection.release).toHaveBeenCalledTimes(1)
        expect(connection.rollback.mock.invocationCallOrder[0]).toBeLessThan(
            connection.release.mock.invocationCallOrder[0]!,
        )
    })
})

function createFakePool(connection: PoolConnection): Pool & {
    getConnection: jest.Mock
} {
    return {
        getConnection: jest.fn(async () => connection),
    } as unknown as Pool & { getConnection: jest.Mock }
}

function createFakeConnection(): PoolConnection & {
    beginTransaction: jest.Mock
    commit: jest.Mock
    release: jest.Mock
    rollback: jest.Mock
} {
    return {
        beginTransaction: jest.fn(async () => undefined),
        commit: jest.fn(async () => undefined),
        release: jest.fn(),
        rollback: jest.fn(async () => undefined),
    } as unknown as PoolConnection & {
        beginTransaction: jest.Mock
        commit: jest.Mock
        release: jest.Mock
        rollback: jest.Mock
    }
}
