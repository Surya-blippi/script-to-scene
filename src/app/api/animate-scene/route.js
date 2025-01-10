import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request) {
  try {
    const { prompt, first_frame_image, prompt_optimizer } = await request.json();

    // Handle if the image is a base64 string
    let imageUrl = first_frame_image;
    if (first_frame_image.startsWith('data:image')) {
      // The image is already a base64 string, we can use it directly
      imageUrl = first_frame_image;
    } else {
      // If it's a URL, we need to fetch it and convert to base64
      try {
        const imageResponse = await fetch(first_frame_image);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type');
        imageUrl = `data:${mimeType};base64,${base64Image}`;
      } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json(
          { error: "Failed to process image" },
          { status: 500 }
        );
      }
    }

    // Call Replicate API with the processed image
    const output = await replicate.run("minimax/video-01-live", {
      input: {
        prompt: prompt,
        first_frame_image: imageUrl,
        prompt_optimizer: prompt_optimizer || true
      },
    });

    // Return the video URL
    return NextResponse.json({ videoUrl: output });
  } catch (error) {
    console.error("Error generating animation:", error);
    return NextResponse.json(
      { error: "Failed to generate animation" },
      { status: 500 }
    );
  }
}