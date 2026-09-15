document.addEventListener('DOMContentLoaded', () => {

    // --- Header Search Bar ---
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `https://www.etsy.com/shop/WildBoneWorkers?search_query=${encodeURIComponent(query)}`;
            }
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });
    }

    // --- Product Page Image Gallery ---
    const mainImage = document.getElementById('main-product-image');
    const thumbnails = document.querySelectorAll('.thumbnail-img');

    if (mainImage && thumbnails.length > 0) {
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', function () {
                thumbnails.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                // Fade transition
                mainImage.style.opacity = '0';
                setTimeout(() => {
                    mainImage.src = this.src;
                    mainImage.alt = this.alt;
                    mainImage.style.opacity = '1';
                }, 120);
            });
        });
    }

    // --- Sticky header shadow on scroll ---
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                header.style.boxShadow = '0 3px 14px rgba(0,0,0,0.55)';
            } else {
                header.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            }
        }, { passive: true });
    }

    // --- Smooth reveal for product cards ---
    const cards = document.querySelectorAll('.product-card');
    if ('IntersectionObserver' in window && cards.length > 0) {
        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(18px)';
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease, box-shadow 0.22s, border-color 0.22s';
        });
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        cards.forEach(card => observer.observe(card));
    }
});

// Main image fade transition style
(function () {
    const style = document.createElement('style');
    style.textContent = `#main-product-image { transition: opacity 0.12s ease; }`;
    document.head.appendChild(style);
})();

// Hero Carousel Logic
document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 0) {
        let currentSlide = 0;
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000);
    }
});
