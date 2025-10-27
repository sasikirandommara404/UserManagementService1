import request from 'supertest';
import app from '../app.js';
import jwt from 'jsonwebtoken';

let token;
let accessToken;
let refreshToken;
let newAccessToken;
let userId;

/*
Note : For these tests to run successfully, ensure that:
use a valid email 
*/

describe('User Registration and Verification', () => {
    
    it('should register a new user and send verification email', async () => {
        const userData = {
            email: '18020ec215@gmail.com',
            password: '123456789',
            first_name: 'John',
            last_name: 'Doe',
            phone_number: '9949897936'
        };
        const response = await request(app).post('/api/auth/register').send(userData);
        token = response.body.token;
        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Registration successful, verification email sent.');
        expect(response.body.token).toBeDefined();
    });
    
    it('should verify the user email', async () => {
        const response = await request(app).get(`/api/auth/verify/${token}`);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Email verified successfully.');
    });
});

describe('User Login and Token Refreshment', () => {

    it('should login the user and return access and refresh tokens', async () => {
        const loginData = {
            email: '18020ec215@gmail.com',
            password: '123456789'
        };
        const response = await request(app).post('/api/auth/login').send(loginData);
        accessToken = response.body.accessToken;
        refreshToken = response.body.refreshToken;
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
    });
    
    it('should refresh the access token using the refresh token', async () => {
        const response = await request(app).post('/api/auth/refresh-token').send({ refreshToken: refreshToken });
        newAccessToken = response.body.accessToken;
        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
        expect(response.body.message).toBe('Access token refreshed');
    });
});

describe('User Profile Management', () => {
    
    it('should get all users', async () => {
        const response = await request(app).get('/api/auth/users')
            .set('Authorization', `Bearer ${newAccessToken}`);
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
    
    it('should get user by ID', async () => {
        const payload = jwt.decode(newAccessToken);
        userId = payload.userId;
        const response = await request(app).get(`/api/auth/users/${userId}`)
            .set('Authorization', `Bearer ${newAccessToken}`);
        expect(response.status).toBe(200);
        expect(response.body.id).toEqual(userId);
    });
    
    it('should update user details', async () => {
        // First: Update WITHOUT email (should succeed)
        const updatesWithoutEmail = {
            first_name: 'Jane',
            last_name: 'Smith',
            phone_number: '9876543210'
        };
        
        const response1 = await request(app).put(`/api/auth/users/${userId}`)
            .set('Authorization', `Bearer ${newAccessToken}`)
            .send(updatesWithoutEmail);
        
        expect(response1.status).toBe(200);
        expect(response1.body.first_name).toBe(updatesWithoutEmail.first_name);
        expect(response1.body.last_name).toBe(updatesWithoutEmail.last_name);
        expect(response1.body.phone_number).toBe(updatesWithoutEmail.phone_number);
        
        // Second: Try to update WITH email (should fail with 400 or 401)
        const updatesWithEmail = {
            email: 'jane@example.com'
        };
        
        const response2 = await request(app).put(`/api/auth/users/${userId}`)
            .set('Authorization', `Bearer ${newAccessToken}`)
            .send(updatesWithEmail);
        
        // Accept either 400 or 401 since validation happens at middleware level
        expect([400, 401]).toContain(response2.status);
    });
    
    it('should delete the user', async () => {
        const response = await request(app).delete(`/api/auth/users/${userId}`)
            .set('Authorization', `Bearer ${newAccessToken}`);
        
        // Your API returns 200, not 204
        expect(response.status).toBe(204);
    });
    
    it('should logout the user', async () => {
        const response = await request(app).post('/api/auth/logout')
            .set('Authorization', `Bearer ${newAccessToken}`);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Logged out successfully');
    });
});

// Clean up after all tests to prevent Jest from hanging
afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
});