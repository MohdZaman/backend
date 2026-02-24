import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel:{
        type: Schema.Types.ObjectId,
        ref: "User"
    }
},{timestamps: true
})

export const Subscription = mongoose.model("Subscription", subscriptionSchema)


// to count the subscription we match the channel for example if we want to count the subscription of a channel we will match the channel and then we will count the number of documents in the subscription collection that match the channel and then we will return the count as the number of subscribers for that channel.

// to check if a user is subscribed to a channel we will match the subscriber and the channel and then we will check if there is a document in the subscription collection that match the subscriber and the channel and then we will return true if there is a document and false if there is no document.