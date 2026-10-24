

        document.addEventListener("DOMContentLoaded", function () {

            const serviceCards =
                document.querySelectorAll(
                    ".premium-service-card"
                );

            serviceCards.forEach(function (card) {

                card.addEventListener("toggle", function () {

                    if (card.open) {

                        serviceCards.forEach(function (otherCard) {

                            if (otherCard !== card) {

                                otherCard.removeAttribute("open");

                            }

                        });

                    }

                });

            });

        });

    