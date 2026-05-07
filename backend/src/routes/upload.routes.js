'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/image',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error('No file uploaded');
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    return ApiResponse.created(res, { url: fileUrl, filename: req.file.filename }, 'File uploaded');
  })
);

module.exports = router;
