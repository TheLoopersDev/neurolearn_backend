import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Certificate from '../models/Certificate.model';

export const getCertificateById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid certificate ID' });
  }

  try {
    const certificate = await Certificate.findById(id)
      .populate('user', 'name email')
      .populate('course', 'title');

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    res.status(200).json(certificate);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getAllCertificates = async (req: Request, res: Response) => {
  try {
    const isAdmin = (req.user as any)?.role === 'admin';
    const filter = isAdmin ? {} : { user: req.user?._id };

    const certificates = await Certificate.find(filter)
      .populate('user', 'name email')
      .populate('course', 'title');

    res.status(200).json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getCertificateByUser = async (req: Request, res: Response) => {
  const { userId, courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid userId or courseId' });
  }

  try {
    const certificate = await Certificate.findOne({ user: userId, course: courseId })
      .populate('user', 'name email')
      .populate('course', 'title');

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    res.status(200).json(certificate);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getCertificateByCourse = async (req: Request, res: Response) => {
  const { courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ message: 'Invalid courseId' });
  }

  try {
    const certificates = await Certificate.find({ course: courseId })
      .populate('user', 'name email')
      .populate('course', 'title');

    res.status(200).json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getCertificatesByInstructor = async (req: Request, res: Response) => {
  try {
    const instructorId = req.user?._id;

    if (!instructorId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // First, find all courses created by this instructor
    const Course = mongoose.model('Course');
    const instructorCourses = await Course.find({ authorId: instructorId }).select('_id');

    if (instructorCourses.length === 0) {
      return res.status(200).json([]);
    }

    const courseIds = instructorCourses.map(course => course._id);

    // Then, find all certificates for these courses
    const certificates = await Certificate.find({ course: { $in: courseIds } })
      .populate('user', 'name email')
      .populate('course', 'title authorId')
      .sort({ createdAt: -1 });

    res.status(200).json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
