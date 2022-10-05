const deleteProduct = (btn) => {
    const prodId = btn.parentNode.querySelector('[name=productId]').value;
    const csrf = btn.parentNode.querySelector('[name=_csrf]').value;
    
    const productContainer = btn.closest('article');

    //If not url is specified is send the request to the same server
    fetch('/admin/product/'+prodId, {
        method: 'DELETE',
        headers: { //-> admin by the csrf token package 
            'csrf-token': csrf
        }
    })
    .then(result => {
        return result.json();
    })
    .then(data => { 
        console.log(data);
        productContainer.parentNode.removeChild(productContainer);//remove the element from the dom
    })
    .catch(err => {
        console.log(err);
    });
};