# Install and load any required packages
.requiredPackages <- c("linprog")
.packagesToInstall <- setdiff(.requiredPackages, installed.packages())
if (length(.packagesToInstall) > 0) install.packages(.packagesToInstall)
sapply(.requiredPackages, require, character.only = TRUE)

# Read the data from the exchange folder.
args <- commandArgs(trailingOnly = TRUE)
parts_list <- read.csv(if (!is.na(args[1])) args[1] else ".r-exchange/partsList.csv", stringsAsFactors = FALSE)
availability <- read.csv(if (!is.na(args[2])) args[2] else ".r-exchange/availability.csv", stringsAsFactors = FALSE)

# Create the reference part id list. Note that I ignore both:
# a) the requirement for part ids that are not available on the market, and
# b) the availability of part ids that are not a requirement
# TODO: did I find a suitable place to warn the user about the parts that
#       could not be found on the market? 
part_id_reference <- sort(intersect(unique(availability$partId), unique(parts_list$partId)))

# Create the reference seller list. Note that I ignore the availability of 
# parts that are not in the reference parts list created above.
sellers_reference <- sort(unique(availability[availability$partId %in% part_id_reference, c('sellerUsername')]))

# See the documentation at http://dico.im/1nBkI4i ; the following creates the 
# elements of the integer linear programming problem as required to get to 
# standard form and apply the simplex algorithm.

# 'c' is a quite reserved word in R! :-)
c_ <- as.vector(sapply(sellers_reference, function (seller_username) {
    return(sapply(part_id_reference, function (part_id) {
        prices_per_seller <- availability[(availability$sellerUsername == seller_username) & 
                                          (availability$partId == part_id), ]$price
        return(if (length(prices_per_seller) == 0) NA else max(prices_per_seller))
    }, USE.NAMES = FALSE))
}, USE.NAMES = FALSE))

r <- sapply(part_id_reference, function (part_id) {
    return(sum(parts_list[parts_list$partId == part_id, c("quantity")]))    
})

v <- sapply(sellers_reference, function (seller_username) {
    return(availability[availability$sellerUsername == seller_username, c("minBuy")][1])
}, USE.NAMES = FALSE)

b <- c(c_, r, v)
