import joi from 'joi';


export const userRegister = joi.object(
    {
        first_name: joi.string().min(3).max(30).required().messages({
            'string.base': `"first_name" should be a type of 'text'`,
            'string.empty': `"first_name" cannot be an empty field`,
            'string.min': `"first_name" should have a minimum length of {#limit}`,
            'string.max': `"first_name" should have a maximum length of {#limit}`,
            'any.required': `"first_name" is a required field`
          }),
        last_name: joi.string().min(3).max(30).required().messages({
              'string.base': `"last_name" should be a type of 'text'`,
              'string.empty': `"last_name" cannot be an empty field`,
              'string.min': `"last_name" should have a minimum length of {#limit}`,
              'string.max': `"last_name" should have a maximum length of {#limit}`,
              'any.required': `"last_name" is a required field`
            }),
        email: joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required().messages({
              'string.base': `"email" should be a type of 'text'`,
              'string.empty': `"email" cannot be an empty field`,
              'string.email': `"email" must be a valid email address`,
              'any.required': `"email" is a required field`
            }),
        password: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{8,30}$')).required().messages({
                'string.base': `"password" should be a type of 'text'`,
                'string.empty': `"password" cannot be an empty field`,
                'string.pattern.base': `Password must contain at least one uppercase letter, one lowercase letter and one number`,
                'any.required': `"password" is a required field`
          }),
        phone_number: joi.string().pattern(new RegExp('^[5-9][0-9]{9}$')).required().messages({
                'string.base': `"phone_number" should be a type of 'text'`,
                'string.empty': `"phone_number" cannot be an empty field`,
                'string.pattern.base': `Phone Number must be a valid Indian Phone number(10 digits starting from with 5-9) `,
                'any.required': `"phone_number" is a required field`
          }),
          role:joi.string().valid('user','admin').optional().messages({
            'string.base': `"role" should be a type of 'text'`,
            'any.only': `"role" must be one of [user, admin]`,
          })

}); 

export const userLogin = joi.object(
    {
        email: joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required().messages({
              'string.base': `"email" should be a type of 'text'`,
              'string.empty': `"email" cannot be an empty field`,
              'string.email': `"email" must be a valid email address`,
              'any.required': `"email" is a required field`
            }),
        password: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{8,30}$')).required().messages({
                'string.base': `"password" should be a type of 'text'`,
                'string.empty': `"password" cannot be an empty field`,
                'string.pattern.base': `Password must contain at least one uppercase letter, one lowercase letter and one number`,
                'any.required': `"password" is a required field`
          }),
});
export const updateUserinput = joi.object(
  {
      first_name: joi.string().min(3).max(30).messages({
            'string.base': `"first_name" should be a type of 'text'`,
            'string.empty': `"first_name" cannot be an empty field`,
            'string.min': `"first_name" should have a minimum length of {#limit}`,
            'string.max': `"first_name" should have a maximum length of {#limit}`,
        }),
      last_name: joi.string().min(3).max(30).messages({
            'string.base': `"last_name" should be a type of 'text'`,    
            'string.empty': `"last_name" cannot be an empty field`,
            'string.min': `"last_name" should have a minimum length of {#limit}`,
            'string.max': `"last_name" should have a maximum length of {#limit}`,
        }),
        phone_number: joi.string().pattern(new RegExp('^[5-9][0-9]{9}$')).messages({
            'string.base': `"phone_number" should be a type of 'text'`,
            'string.empty': `"phone_number" cannot be an empty field`,  
            'string.pattern.base': `Phone Number must be a valid Indian phone number (10 digits starting with 5-9)`,
        }),
        email: joi.forbidden().messages({
            'any.unknown': `"email" cannot be updated`,
        }),
    }
); 
  