import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("REPLICATE_API_TOKEN is not configured");
    return NextResponse.json(
      { error: "Replicate API token is not configured" },
      { status: 500 }
    );
  }

  try {
    const { prompt, style, aspectRatio, quality } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const output = await replicate.run(
      "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
      {
        input: {
          prompt: prompt,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50,
        },
      }
    );

    if (!output || !output[0]) {
      throw new Error("No output received from Replicate");
    }

    const imageUrl = output[0];
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch generated image");
    }
    
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageArrayBuffer).toString("base64");

    return NextResponse.json({ 
      imageUrl: `data:image/png;base64,${base64Image}`,
      originalUrl: imageUrl
    });
  } catch (error) {
    console.error("Error details:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate image", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}