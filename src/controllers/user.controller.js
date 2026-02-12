import { asynchandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
const registerUser = asynchandler(async(req,res) => {
   // get user detail from frontend
   // vallidateion noit empty
   // check if user exist in database we can do it by email or username or both
   // check for images, check for avatar
   // upload image to cloudinary,avatar
   // create user object - create user in database
   // remove password and refresh token from response
   // check for user creation 
   // return res

   const {fullname, email, username, password} = req.body
   console.log("email:", email);
    // we can check everything separately through this if condition there is no problem in this.. remember it it is easy but for professional coding we prefer this to avoid that much efforts
//    if(fullname === ""){
//     throw new ApiError(400, "Fullname is required")
//    }

    if(
        [fullname, email, username, password].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400, "All fields are required")
    }
   const existedUser =  User.findOne({
        $or: [{ email }, { username }]
    })
    if(existedUser){
        throw new ApiError(409, "User already exist with this email or username")
    }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path;

   if(!avatarLocalPath){
    throw new ApiError(400, "Avatar is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
   if(!avatar){
       throw new ApiError(500, "Failed to upload avatar image")
   }

   const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
   })

   const createdUser = await User.findById(user._id).select("-password -refreshToken")
   
   if(!createdUser){
    throw new ApiError(500,"Something went wrong while registring user")
   }

   return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
   )
})

export {registerUser}