import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserT } from '../interfaces/User';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: The user's full name
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         password:
 *           type: string
 *           format: password
 *           description: The user's password (min 6 characters)
 *         role:
 *           type: string
 *           enum: [user, admin, instructor]
 *           default: user
 *           description: The user's role in the system
 *         avatar:
 *           type: object
 *           properties:
 *             public_id:
 *               type: string
 *             url:
 *               type: string
 *         isVerified:
 *           type: boolean
 *           default: false
 *           description: Whether the user's email is verified
 *         purchasedCourses:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of purchased course IDs
 *         uploadedCourses:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of uploaded course IDs
 *         introduce:
 *           type: string
 *           description: User's introduction
 *         profession:
 *           type: string
 *           description: User's profession
 *         phoneNumber:
 *           type: string
 *           description: User's phone number
 *         address:
 *           type: string
 *           description: User's address
 *         age:
 *           type: number
 *           minimum: 0
 *           description: User's age
 *         rating:
 *           type: number
 *           description: User's rating
 *         student:
 *           type: number
 *           description: Number of students
 *         socialLinks:
 *           type: object
 *           properties:
 *             facebook:
 *               type: string
 *             twitter:
 *               type: string
 *             linkedin:
 *               type: string
 *             instagram:
 *               type: string
 *       example:
 *         name: John Doe
 *         email: john@example.com
 *         role: user
 *         isVerified: false
 */

export const UserSchema: Schema<UserT> = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide user name'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Please provide email'],
            match: [
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                'Please provide a valid email'
            ],
            unique: true,
            trim: true
        },
        password: {
            type: String,
            minlength: [6, 'Password must be more than 6 characters'],
            trim: true,
            select: false
        },
        confirmPassword: {
            type: String,
            minlength: [6, 'Password must be more than 6 characters'],
            trim: true,
            validate: {
                validator: function (this: UserT, el: string): boolean {
                    return el === this.password;
                },
                message: 'Passwords do not match!'
            }
        },
        role: {
            type: String,
            trim: true,
            lowercase: true,
            enum: ['user', 'admin', 'instructor', 'business'],
            default: 'user'
        },
        avatar: {
            public_id: String,
            url: String
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        purchasedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course'
            }
        ],
        uploadedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course'
            }
        ],
        introduce: {
            type: String,
            default: ''
        },
        profession: {
            type: String,
            trim: true,
            default: ''
        },
        phoneNumber: {
            type: String,
            trim: true,
            default: ''
        },
        address: {
            type: String,
            trim: true,
            default: ''
        },
        age: {
            type: Number,
            min: [0, 'Age must be a positive number'],
            default: null
        },
        rating: {
            type: Number,
            default: null
        },
        student: {
            type: Number,
            default: null
        },
        socialLinks: {
            facebook: { type: String, default: '' },
            twitter: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            instagram: { type: String, default: '' }
        },
        businessInfo: {
            businessId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Business',
                default: null
            },
            role: {
                type: String,
                enum: ['admin', 'manager', 'employee'],
                default: null
            }
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.__v;
                delete ret.password;
                delete ret.confirmPassword;
                return ret;
            }
        },
        toObject: {
            transform: (doc, ret) => {
                delete ret.__v;
                delete ret.password;
                delete ret.confirmPassword;
                return ret;
            }
        }
    }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Sign access token
UserSchema.methods.signAccessToken = function () {
    return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || '', {
        expiresIn: '10h'
    });
};

// Sign refresh token
UserSchema.methods.signRefreshToken = function () {
    return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || '', {
        expiresIn: '3d'
    });
};

// Compare password
UserSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model<UserT>('User', UserSchema);
