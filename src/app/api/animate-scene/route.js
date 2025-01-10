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
    const { prompt, first_frame_image, prompt_optimizer } = await request.json();

    if (!prompt || !first_frame_image) {
      return NextResponse.json(
        { error: "Prompt and first frame image are required" },
        { status: 400 }
      );
    }

    const output = await replicate.run("minimax/video-01-live", {
      input: {
        prompt: prompt,
        first_frame_image: first_frame_image,
        prompt_optimizer: prompt_optimizer || true
      },
    });

    if (!output) {
      throw new Error("No output received from Replicate");
    }

    return NextResponse.json({ videoUrl: output });
  } catch (error) {
    console.error("Error details:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate animation", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}