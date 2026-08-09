import dotenv from 'dotenv'
import mysql2 from 'mysql2/promise'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

// MySQL validation func
function requireDbUser() : string{
    const user = process.env.DB_USER
    if(!user){
        throw new Error("Set DB_USER in .env")
    }
    return user
}

function requireDbPassword() : string{
    const password = process.env.DB_PASSWORD
    if(!password){
        throw new Error("Set DB_PASSWORD in .env")
    }
    return password
}

function requireDbName() : string{
    const name = process.env.DB_NAME
    if(!name){
        throw new Error("Set DB_NAME in .env")
    }
    return name
}

function requireDbHost() : string{
    const host = process.env.DB_HOST
    if(!host){
        throw new Error("Set DB_HOST in .env")
    }
    return host
}

// Supabase validation func
function requireSupaUrl() : string{
    const url = process.env.SUPA_URL
    if(!url){
        throw new Error("Set SUPA_URL in .env")
    }
    return url
}

function requireSupaSecretKey(): string{
    const key = process.env.SUPA_SECRET_KEY
    if(!key){
        throw new Error("Set SUPA_SECRET_KEY in .env")
    }
    return key
}

// MySQL pool
//export const pool = mysql2.createPool({
//    user: requireDbUser(),
//    password: requireDbPassword(),
//    database: requireDbName(),
//    host: requireDbHost(),
//    connectionLimit: 10,
//})

// Supabase pool
export const supabase = createClient(
    requireSupaUrl(),
    requireSupaSecretKey()
)
