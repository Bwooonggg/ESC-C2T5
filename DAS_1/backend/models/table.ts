import type { ScreeningSession } from "../../demo_app/shared/types.ts";
import {supabase} from "./db.ts"
import * as fs from "node:fs/promises"
import { projectRoot, dataFile } from "../config.ts";
import path from "node:path"

const tableName = "responses"

// MySQL functions
//export async function checkDb() : Promise<void>{
//    try{
//        // Might want to change report to some other datatype
//        await pool.query(`
//            CREATE TABLE IF NOT EXISTS ${tableName}(
//                id varchar(36) PRIMARY KEY,
//                screenerType varchar(10),
//                stage varchar(10),
//                messages JSON,
//                responses JSON,
//                notes varchar(255),
//                report LONGTEXT,
//                contact JSON,
//                createdAt varchar(255),
//                updatedAt varchar(255)
//            )    
//        `);
//    }
//    catch(error){
//        console.error("database connection failed. " + error);
//        throw error;
//    }
//}
//
//export async function insert(session: ScreeningSession): Promise<void>{
//    await checkDb()
//    try{
//        await pool.query(`
//            INSERT INTO ${tableName} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`, 
//            [
//            session.id,
//            session.screenerType,
//            session.stage,
//            JSON.stringify(session.messages),
//            JSON.stringify(session.responses),
//            session.notes,
//            session.report,
//            JSON.stringify(session.contact),
//            session.createdAt,
//            session.updatedAt
//            ]
//        )
//    }
//    catch(error){
//        console.error("database connection failed. " + error);
//        throw error;
//    }
//}

export async function insertSupa(session : ScreeningSession) : Promise<void>{
    // The table should have been created in supabase beforehand
    try{
        const {error} = await supabase
        .from(tableName)
        .upsert({
            id: session.id,
            screenerType: session.screenerType,
            stage: session.stage,
            messages: session.messages,
            responses: session.responses,
            notes: session.notes,
            report: session.report,
            contact: session.contact,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        },
        {
            onConflict: "id",
            ignoreDuplicates: true,
        })

        if(error){
            console.error("Data insertion failed")
            throw error
        }
    }
    catch(error){
        console.error("database connection failed. " + error);
        throw error;
    }
}

// A really crappy solution to the fact that the db can only insert one at a time
export async function moveSessionFile() : Promise<void>{
    try{
        const newDir = path.join(projectRoot, "backend", "data", "just_submitted")
        console.log(newDir)
        await fs.mkdir(newDir, {recursive : true})

        let sourceFile = dataFile
        let destFile = path.join(projectRoot, "./backend/data/just_submitted", "sessions.json")
        await fs.rename(sourceFile, destFile)
    }
    catch(error){
        console.error("File move failed" + error)
        throw error
    }
    
}