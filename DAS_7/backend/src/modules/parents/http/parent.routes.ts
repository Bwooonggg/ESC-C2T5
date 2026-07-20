import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'

export const parentRouter = Router()

parentRouter.get('/me', notImplemented)
