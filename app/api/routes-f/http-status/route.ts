import { NextRequest, NextResponse } from 'next/server';
import { getStatusByCode, getStatusesByCategory, findNearestStatus } from './data';
import { HttpStatusResponse, HttpStatusListResponse } from './types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codeParam = searchParams.get('code');

  if (codeParam) {
    const code = parseInt(codeParam, 10);
    
    if (isNaN(code)) {
      return NextResponse.json(
        { error: 'Invalid status code format' },
        { status: 400 }
      );
    }

    const status = getStatusByCode(code);
    
    if (status) {
      const response: HttpStatusResponse = {
        code: status.code,
        name: status.name,
        description: status.description,
        category: status.category,
        ...(status.rfc && { rfc: status.rfc })
      };
      
      return NextResponse.json(response);
    } else {
      const nearest = findNearestStatus(code);
      const suggestion = nearest 
        ? `Did you mean ${nearest.code} (${nearest.name})?`
        : 'No similar status code found';
      
      return NextResponse.json(
        { 
          error: `HTTP status code ${code} not found`,
          suggestion 
        },
        { status: 404 }
      );
    }
  } else {
    const groupedStatuses = getStatusesByCategory();
    const response: HttpStatusListResponse = {};
    
    Object.keys(groupedStatuses).forEach(category => {
      response[category] = groupedStatuses[category].map(status => ({
        code: status.code,
        name: status.name,
        description: status.description,
        category: status.category,
        ...(status.rfc && { rfc: status.rfc })
      }));
    });
    
    return NextResponse.json(response);
  }
}
