import type { EmailAddress } from '../../../domain/value-objects/email-address.js'
import type { User } from '../../../domain/entities/user.js'

export interface UserRepository {
    findById(userId: string): Promise<User | null>
    findByEmail(email: EmailAddress): Promise<User | null>
    save(user: User): Promise<void>
}
