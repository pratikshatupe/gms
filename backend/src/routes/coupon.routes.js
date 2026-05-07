'use strict';

const express          = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { isSuperAdmin } = require('../middlewares/role.middleware');
const { resolveTenant }= require('../middlewares/tenant.middleware');
const { couponApplyLimiter } = require('../middlewares/rateLimit.middleware');
const ctrl             = require('../controllers/coupon.controller');

const router = express.Router();

/* ─── Public, rate-limited endpoints used by the signup flow ─── */
router.post('/apply',  couponApplyLimiter, ctrl.apply);
router.post('/redeem', couponApplyLimiter, ctrl.redeem);

/* ─── Authenticated admin endpoints below ─── */
router.use(authenticate);

router.post('/',            isSuperAdmin, ctrl.create);
router.get('/',             isSuperAdmin, ctrl.list);
router.patch('/:id/toggle', isSuperAdmin, ctrl.toggle);
router.delete('/:id',       isSuperAdmin, ctrl.remove);

router.post('/validate', resolveTenant, ctrl.validate);

module.exports = router;
