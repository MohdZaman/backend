class ApiError extends Error {
    constructor(
        statusCode,
         message = "Something went wrong",
         errors = []
        )
          {
            super(message);
            this.statusCode = statusCode;
            this.errors = errors;
            this.data = null;
            this.message = message;
            this.success = false;
            this.stack = "";

            if(stack){
              this.stack = stack;
              Error.captureStackTrace(this, this.constructor);
            }
          }
}

export  {ApiError};