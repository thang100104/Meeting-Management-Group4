import { Router } from 'express';
import { getUsers } from '../controllers/user.controller';
import { authenticateBearer } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { getUsersQuerySchema } from '../schemas/user.schema';

const router = Router();

router.get('/', authenticateBearer, validate({ query: getUsersQuerySchema }), getUsers);

export default router;
