import { asynchandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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
        $unset: {
            refreshToken: 1
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

const changeCurrentPassword = asynchandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Old password is incorrect")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asynchandler(async(req,res)=>{
    return res.status(200).json(
        200, req.user, "User fetched successfully"

    )
})

const updateUserProfile = asynchandler(async(req,res)=>{
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, "Fullname and email are required")
    }
  const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, user, "User profile updated successfully")
    )
})

const updateUserAvatar = asynchandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required")
    }

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     if(!avatar.url){
        throw new ApiError(500, "Failed to upload avatar image")
     }
    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
     ).select("-password")
     return res.status(200)
    .json(
        new ApiResponse(200, user, "User profile updated successfully")
    )
})
const updateUserCoverImage = asynchandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is required")
    }

     const coverImage = await uploadOnCloudinary(coverImageLocalPath)
     if(!coverImage.url){
        throw new ApiError(500, "Failed to upload cover image")
     }
    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
     ).select("-password")
     return res.status(200)
    .json(
        new ApiResponse(200, user, "User profile updated successfully")
    )
})

const getUserchannelprofile = asynchandler(async(req,res)=>{
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400, "Username is required")
    }
  const channel =  await  User.aggregate([
    {
        $match:{
            username: username?.toLowerCase()
        },
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
     $lookup:{
         from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
     }
     },
     {
        $addFields:{
            subscribersCount: {$size: "$subscribers"},
            subscribedToCount: {$size: "$subscribedTo"},
             isSubscribed: {
                $cond:{
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
             }

        }
     },
     {
     $project:{
        fullname: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        email: 1,

     }
     }
  ])
  if(!channel?.length){
    throw new ApiError(404, "Channel not found")
  }
  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "Channel profile fetched successfully")
  )
})

const getWatchHistory = asynchandler(async(req,res)=>{
    const user = await User.aggregate([
        {
        $match:{
            _id: new mongoose.Types.ObjectId(req.user._id),
        }
    },
    {
    $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
            {
                $lookup:{
                    from:"users",
                    localField:"owner",
                    foreignField:"_id",
                    as:"owner",
                    pipeline:[
                        {
                            $project:{
                                fullname:1,
                                username:1,
                                avatar:1,
                            }
                        }
                    ]

                }
            },
            {
                $addFields:{
                    owner:{
                        $first: "$owner"
                    }
                }
            }
        ]
    }
    }
    
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHisrory,
            "Watch History fetched Successfully"
            
        )
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserProfile,
    updateUserAvatar,
    updateUserCoverImage,
    getUserchannelprofile,
    getWatchHistory,
    
}