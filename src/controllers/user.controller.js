import { asynchandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async(userId)=>{
        try {
            const user = await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshToken = refreshToken
            await user.save({validateBeforeSave: false})

            return {accessToken, refreshToken}
        } catch (error) {
            throw new ApiError(500, "Failed to generate access and refresh token")
        }
    }
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
//    console.log("email:", email);
    // we can check everything separately through this if condition there is no problem in this.. remember it it is easy but for professional coding we prefer this to avoid that much efforts
//    if(fullname === ""){
//     throw new ApiError(400, "Fullname is required")
//    }

    if(
        [fullname, email, username, password].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400, "All fields are required")
    }
   const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    if(existedUser){
        throw new ApiError(409, "User already exist with this email or username")
    }

   const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

   if(!avatarLocalPath){
    throw new ApiError(400, "Avatar is required")
   }
   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
    coverImageLocalPath = req.files.coverImage[0].path;
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

const loginUser = asynchandler(async (req,res)=>{
    // req body -> email, password
    // username or email 
    // find the user 
    // password check 
    // access token and refresh token
    // send cookie 
    const {email, username, password} = req.body
    if(!username && !email){
        throw new ApiError(400, "Username or email is required")
    }
    const user = await User.findOne({
        $or: [{email}, {username}]
    })
    if(!user){
        throw new ApiError(404, "User does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }
   const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

   const loggedinUser = await User.findById(user._id).select("-password -refreshToken")

   const options = {
    httpOnly: true,
    secure: true,
   }

   return res.status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
    new ApiResponse(200,
        {
            user: loggedinUser, accessToken, refreshToken 

        },
        "User logged in successfully"
    )
   )
    
})
const logoutUser = asynchandler(async(req,res)=>{
  await  User.findByIdAndUpdate(
        req.user._id,
    {
        $set: {
            refreshToken: undefined
        }
    },
        {
            new: true,
        
    }
    )
    const options = {
    httpOnly: true,
    secure: true,
   }
   return res.status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(
    new ApiResponse(200,{},"User logged out successfully")
   )
})

const refreshAccessToken = asynchandler(async(req,res)=>{
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorized request")
   }
  try {
    const decodedToken= jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
  
      const user = await User.findById(decodedToken?._id)
  
      if(!user){
          throw new ApiError(401, "Invalid refresh token")
      }
  
      if(incomingRefreshToken !== user?.refreshToken){
       throw new ApiError(401, " Refresh token is expired or used")
      }
  
      const options = {
          httpOnly: true,
          secure: true,
      }
     const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
  
       return res
       .status(200)
       .cookie("accessToken", accessToken, options)
       .cookie("refreshToken", newRefreshToken, options)
       .json(
          new ApiResponse(200, {accessToken, refreshToken: newRefreshToken},"Access token refreshed successfully")
       )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}