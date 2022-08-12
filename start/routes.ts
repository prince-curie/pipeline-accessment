/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/

import Route from '@ioc:Adonis/Core/Route';
import { schema, rules } from '@ioc:Adonis/Core/Validator';


Route.get('/howold', async ({ request, response }) => {  
  const currentTime:number = Date.now()
  
  const dob:number = await validateData(request, currentTime);
  
  try {
    const dobYear:number = (new Date(dob)).getFullYear();
    const currentYear:number = (new Date(currentTime)).getFullYear();
    
    const age:number = currentYear - dobYear;
  
    return response.status(200).json({
      message: "Age returned successfully.",
      data: {
        age
      }
    });
  } catch (error) {
    return response.status(500).json({
      message: "System error."
    });
  }  
}).middleware('throttle:global')

interface IValidate {
  dob:number
};

async function validateData(request:any, currentTime:number):Promise<number> {
  const dobSchema = schema.create({
    dob: schema.number([ rules.range(0, currentTime) ])
  })
  
  const dobMessages = {
    required: 'Date of birth is required.',
    number: 'Date of birth is a set of numbers only.',
    range: 'Date of birth should be less than current time and not be a negative value.'
  }
  
  const { dob }:IValidate = await request.validate({ schema: dobSchema, messages: dobMessages });

  return dob
}