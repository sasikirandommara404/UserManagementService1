import express from "express";
import authenticateJWT from "../middleware/protected.js";
import { registerUser,verifyEmail,loginUser, refreshAccessToken,getAllUsers,getUserById,updateUser,deleteUser,logoutUser } from "../authService/auth.controller.js"; 
import Input from "../middleware/validationmiddleware.js"; 
import { userRegister,userLogin,updateUserinput } from "../inputvalidation/validation.js";  
const router = express.Router();
router.post("/register",Input(userRegister),registerUser);
router.get("/verify/:token", verifyEmail); 
router.post("/login",Input(userLogin), loginUser);
router.post("/logout",authenticateJWT, logoutUser)
router.post("/refresh-token", refreshAccessToken); 
router.get('/users',authenticateJWT,getAllUsers);
router.get('/users/:id',authenticateJWT,getUserById);
router.put('/users/:id',Input(updateUserinput),authenticateJWT,updateUser);
router.delete('/users/:id',authenticateJWT,deleteUser);

export default router;

