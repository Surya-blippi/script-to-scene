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
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          num_outputs: 1,
          aspect_ratio: aspectRatio || "16:9",
          output_format: "webp",
          output_quality: 100, // Setting this explicitly to 100 for highest quality
          go_fast: true
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
      imageUrl: `data:image/webp;base64,${base64Image}`,
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