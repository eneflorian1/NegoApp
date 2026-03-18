/**
 * User Model — MongoDB
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const UserModel = mongoose.model('User', userSchema);

export async function createUser(username, password, email = null) {
  const passwordHash = await bcrypt.hash(password, 10);
  return UserModel.create({ username, passwordHash, email: email || undefined });
}

export async function findUserByUsername(username) {
  return UserModel.findOne({ username: username.toLowerCase() });
}

export async function findUserById(id) {
  return UserModel.findById(id).lean();
}

export default UserModel;
