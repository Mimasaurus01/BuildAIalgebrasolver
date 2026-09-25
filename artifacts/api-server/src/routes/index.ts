import { Router, type IRouter } from "express";
import healthRouter from "./health";
import solveRouter from "./solve";

const router: IRouter = Router();

router.use(healthRouter);
router.use(solveRouter);

export default router;
