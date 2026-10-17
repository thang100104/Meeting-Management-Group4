import { Router } from 'express';
import { getRooms } from '../controllers/room.controller';
import { authenticateBearer } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getRoomsQuerySchema } from '../schemas/room.schema';

const router = Router();

router.get('/', authenticateBearer, validate({ query: getRoomsQuerySchema }), getRooms);

export default router;
