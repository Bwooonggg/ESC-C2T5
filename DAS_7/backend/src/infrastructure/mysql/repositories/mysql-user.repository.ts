import type { EmailAddress } from '../../../domain/value-objects/email-address.js'
import type { User } from '../../../domain/entities/user.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'
import { mapUserRow } from '../mappers/index.js'
import type { UserRepository } from '../../../modules/auth/ports/user.repository.js'
import type { RowDataPacket } from 'mysql2/promise'

interface UserRow extends RowDataPacket {}

const userColumns = `
    user_id, email, mobile_number, password_hash, account_type, is_verified
`

export class MySqlUserRepository implements UserRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async findById(userId: string): Promise<User | null> {
        const rows = await executeRows<UserRow>(
            this.executor,
            `
                SELECT ${userColumns}
                FROM users
                WHERE user_id = ?
                LIMIT 1
            `,
            [userId],
        )

        return rows[0] === undefined ? null : mapUserRow(asMysqlRow(rows[0]))
    }

    async findByEmail(email: EmailAddress): Promise<User | null> {
        const rows = await executeRows<UserRow>(
            this.executor,
            `
                SELECT ${userColumns}
                FROM users
                WHERE email = ?
                LIMIT 1
            `,
            [email.value],
        )

        return rows[0] === undefined ? null : mapUserRow(asMysqlRow(rows[0]))
    }

    async save(user: User): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO users
                    (user_id, email, mobile_number, password_hash, account_type, is_verified)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    email = VALUES(email),
                    mobile_number = VALUES(mobile_number),
                    password_hash = VALUES(password_hash),
                    account_type = VALUES(account_type),
                    is_verified = VALUES(is_verified)
            `,
            [
                user.userId,
                user.email.value,
                user.mobileNumber,
                user.passwordHash,
                user.accountType.value,
                user.isVerified,
            ],
        )
    }
}
