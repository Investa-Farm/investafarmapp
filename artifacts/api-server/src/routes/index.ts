import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import farmsRouter from "./farms";
import marketRouter from "./market";
import portfolioRouter from "./portfolio";
import farmerRouter from "./farmer";
import kycRouter from "./kyc";
import aiKycRouter from "./ai-kyc";
import loansRouter from "./loans";
import groupsRouter from "./groups";
import adminRouter from "./admin";
import cropPricesRouter from "./crop-prices";
import walletRouter from "./wallet";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(farmsRouter);
router.use(marketRouter);
router.use(portfolioRouter);
router.use(farmerRouter);
router.use(kycRouter);
router.use(aiKycRouter);
router.use(loansRouter);
router.use(groupsRouter);
router.use(adminRouter);
router.use(cropPricesRouter);
router.use(walletRouter);
router.use(notificationsRouter);

export default router;
