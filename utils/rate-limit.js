export function rateLimit({ interval }) {
    const tokenCache = new Map();
    
    return {
      check: (res, limit, token) =>
        new Promise((resolve, reject) => {
          const tokenCount = tokenCache.get(token) || [0];
          
          if (tokenCount[0] === 0) {
            tokenCache.set(token, tokenCount);
          }
          
          tokenCount[0] += 1;
  
          const currentUsage = tokenCount[0];
          const isRateLimited = currentUsage >= limit;
          
          res.setHeader('X-RateLimit-Limit', limit);
          res.setHeader('X-RateLimit-Remaining', isRateLimited ? 0 : limit - currentUsage);
  
          if (isRateLimited) {
            return reject();
          }
  
          if (tokenCount[0] === 1) {
            setTimeout(() => {
              tokenCache.delete(token);
            }, interval);
          }
  
          resolve();
        }),
    };
  }