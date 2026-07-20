import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'

export const authRouter = Router()

authRouter.post('/login', notImplemented)
authRouter.post('/verify', notImplemented)
authRouter.post('/logout', notImplemented)
