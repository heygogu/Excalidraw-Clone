"use server"
import { api } from "@/lib/axios";
import { cookies } from "next/headers";

interface LoginPayload {
    email: string;
    password: string;
}

const options = {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, // Ensure Axios includes cookies in the request
};
export const login = async (payload: LoginPayload) => {
    try {
        const res = await api.post("/login", payload, options);
        console.log("These are the resposne headers", res.headers);
        return res?.data

    } catch (err: any) {
        console.log(err?.response?.data?.message)
        const message = err?.response?.data?.message || "Login failed";
        throw new Error(message)
    }
};

export const signup = async (payload: LoginPayload) => {
    try {
        const res = await api.post("/signup", payload, { withCredentials: true });
        return res?.data

    } catch (err: any) {
        console.log(err?.response?.data?.message)
        const message = err?.response?.data?.message || "Signup failed";
        throw new Error(message)
    }
};