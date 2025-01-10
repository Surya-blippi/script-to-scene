import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request) {
  try {
    const { prompt, style, aspectRatio, quality } = await request.json();

    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt: prompt,
        num_outputs: 1,
        aspect_ratio: aspectRatio || "16:9",
        output_format: "webp",
        output_quality: quality === 'high' ? 100 : 80,
        go_fast: true,
      },
    });

    const imageUrl = output[0];
    const imageResponse = await fetch(imageUrl);
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageArrayBuffer).toString("base64");

    return NextResponse.json({ 
      imageUrl: `data:image/webp;base64,${base64Image}` 
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}