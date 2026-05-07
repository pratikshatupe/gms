'use strict';

const Announcement = require('../models/Announcement');
const ApiError = require('../utils/ApiError');

async function getAllAnnouncements() {
  return Announcement.find().sort({ createdAt: -1 }).lean();
}

async function getAnnouncementById(id) {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

async function createAnnouncement(data) {
  return Announcement.create(data);
}

async function updateAnnouncement(id, data) {
  const announcement = await Announcement.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

async function deleteAnnouncement(id) {
  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  return announcement;
}

module.exports = {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
