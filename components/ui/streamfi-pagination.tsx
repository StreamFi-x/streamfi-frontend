import page from "@/app/explore/trending/page";
import {
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    Pagination as ShadcnPagination
} from './pagination'


type PaginationProps = {
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
    maxVisiblePages: number,
    showPrevNext?: boolean,
    className?: string
}

const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    maxVisiblePages,
    showPrevNext,
    className
}: PaginationProps) => {
    if (totalPages <= 1) return null;

    const getVisiblePages = () => {
        const pages = [];
        const halfVisible = Math.ceil(maxVisiblePages / 2);
        let startPage = Math.max(1, currentPage - halfVisible);
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2 ) {
                pages.push("ellipsis-start")
            }
        }

        // Middle pages
        for (let i = startPage; i <= endPage; i++) {
            if (i > 0 && i <= totalPages) pages.push(i);
        }

            // Always show last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pages.push("ellipsis-end");
            pages.push(totalPages);
        }

        return pages
    }

    const visiblePages = getVisiblePages();

    return (
        <ShadcnPagination className={className}>
            <PaginationContent>
                {
                    showPrevNext && (
                        <PaginationItem>
                            <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) onPageChange(currentPage - 1);
                                }}
                                aria-disabled={currentPage <= 1}
                                className={currentPage <= 1 ? "opacity-50 cursor-not-allowed" : ""}
                            />
                        </PaginationItem>
                    )
                }

                {
                    visiblePages.map((page, index) => {
                        return (
                            <PaginationItem key={index}>
                                {
                                    typeof page === "number" ? (
                                        <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                onPageChange(page);
                                            }}
                                            isActive={page === currentPage}
                                            className="px-1 py-1"
                                        >
                                            {page}
                                        </PaginationLink>
                                    ) : (
                                        <PaginationEllipsis />
                                    )
                                }
                            </PaginationItem>
                        )
                    })
                }

                {
                    showPrevNext && (
                        <PaginationItem>
                            <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) onPageChange(currentPage + 1);
                                }}
                                aria-disabled={currentPage >= totalPages}
                                className={currentPage >= totalPages ? "opacity-50 cursor-not-allowed" : ""}
                            />
                        </PaginationItem>
                    )
                }
            </PaginationContent>
        </ShadcnPagination>
    )
}

export default Pagination