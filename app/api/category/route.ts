import { NextResponse, NextRequest } from "next/server";
import { sql } from "@vercel/postgres";


//TO CREATE A CATEGORY
export async function POST(req: NextRequest) {
  try {
    const { title, description, tags, imageurl } = await req.json();

    console.log('Category creation request received:', {
      title,
      description,
      tags,
      imageurl,
      timestamp: new Date().toISOString(),
    });

    // Validate input
    if (!title || typeof title !== 'string') {
      console.log('Validation failed: title is required');
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Check for duplicate title (case-insensitive)
    console.log('Checking for existing category with same title...');
    const { rows: existingCategories } = await sql`
      SELECT id FROM stream_categories WHERE LOWER(title) = LOWER(${title})
    `;

    if (existingCategories.length > 0) {
      console.log('Duplicate category found:', title);
      return NextResponse.json(
        { error: 'Category with this title already exists' },
        { status: 409 }
      );
    }

    // Insert into stream_categories
    console.log('📝 Inserting new category...');
    const { rows: insertedRows } = await sql`
      INSERT INTO stream_categories (title, description, tags, "imageurl", created_at)
      VALUES (
        ${title},
        ${description || null},
        ${tags || null},
        ${imageurl || null},
        CURRENT_TIMESTAMP
      )
      RETURNING id, title, description, tags, "imageurl"
    `;

    const createdCategory = insertedRows[0];

    console.log('Category created successfully:', createdCategory);

    return NextResponse.json(
      {
        success: true,
        data: createdCategory,
        message: 'Category created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unhandled category creation error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';

    console.log('Error details:', {
      message,
      stack,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Failed to create category',
        details: message,
      },
      { status: 500 }
    );
  }
}



// TO GET CATEGORIES (ALL, BY SEARCH AND BY ID)
export async function GET(req: Request) {
  try {

    // live search query
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    const title = searchParams.get('id'); // To get category by id

    // Basic test to confirm DB works
    const testResult = await sql`SELECT * FROM stream_categories LIMIT 1`;
    console.log('Test result:', testResult.rows);

    let result;


    if (title) {
      // Get category by ID
      result = await sql`
        SELECT id, title, tags, imageurl
        FROM stream_categories
        WHERE LOWER(title) = ${title.toLowerCase()}
        LIMIT 1
      `;

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        category: result.rows[0],
      });
    }

    if (search) {
      // Filter by title or tags (case-insensitive)
      result = await sql`
        SELECT id, title, tags, imageurl
        FROM stream_categories
        WHERE LOWER(title) LIKE ${'%' + search + '%'}
        OR EXISTS (
          SELECT 1 FROM UNNEST(tags) AS tag
          WHERE LOWER(tag) LIKE ${'%' + search + '%'}
        )
        ORDER BY created_at DESC
      `;
    } else {
      // Get all categories
      result = await sql`
        SELECT id, title, tags, imageurl
        FROM stream_categories
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      categories: result.rows,
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}


// TO UPDATE A CATEGORY
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const titleParams = searchParams.get('id');
    if (!titleParams) {
      return NextResponse.json({ success: false, error: 'Missing category ID' }, { status: 400 });
    }

    const body = await req.json();
    const { title, description, imageurl, is_active } = body;
    const tags = Array.isArray(body.tags) ? body.tags : [];

    await sql`
      UPDATE stream_categories
      SET
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        tags = COALESCE(${(tags)}, tags),
        imageurl = COALESCE(${imageurl}, imageurl),
        is_active = COALESCE(${is_active}, is_active)
       WHERE LOWER(title) = ${titleParams.toLowerCase()}
    `;

    return NextResponse.json({ success: true, message: 'Category updated' });

  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ success: false, error: 'Failed to update category' }, { status: 500 });
  }
}



// TO DELETE A CATEORY
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('id');
    if (!title) {
      return NextResponse.json({ success: false, error: 'Missing category ID' }, { status: 400 });
    }

    await sql`
      DELETE FROM stream_categories
      WHERE LOWER(title) = ${title.toLowerCase()}
    `;

    return NextResponse.json({ success: true, message: 'Category deleted' });

  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 });
  }
}

